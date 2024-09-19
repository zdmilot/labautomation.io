import {
  createIntegration,
  createComponent,
  FetchEventCallback,
  RuntimeContext,
} from "@gitbook/runtime";

type IntegrationContext = {} & RuntimeContext;
type IntegrationBlockProps = {};
type IntegrationBlockState = { 
  message: string; 
  snippets: Array<{ title: string; body: string }>; 
  fetchedIds: Set<string>;  // Track the IDs of fetched posts
};
type IntegrationAction = { action: "click" };

// Periodic fetching function (e.g., every 60 seconds)
const startPeriodicFetch = (stateUpdater: (newState: Partial<IntegrationBlockState>) => void) => {
  setInterval(async () => {
    try {
      const response = await fetch('https://labautomation.io/posts.json');
      const data = await response.json();
      const newSnippets = createSnippets(data, stateUpdater);
      
      // Update the state with new snippets if there are any
      if (newSnippets.length > 0) {
        stateUpdater({ snippets: newSnippets });
      }
    } catch (error) {
      console.error("Error fetching periodic data:", error);
    }
  }, 7200000);  // Fetch every 60 seconds
};

const handleFetchEvent: FetchEventCallback<IntegrationContext> = async (request, context) => {
  const response = await fetch('https://labautomation.io/posts.json');
  const data = await response.json();
  const snippets = createSnippets(data, context.updateState);

  return new Response(JSON.stringify(snippets), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Function to generate snippets with proper checks for missing title or body
function createSnippets(posts: any[], stateUpdater: (newState: Partial<IntegrationBlockState>) => void): Array<{ title: string; body: string }> {
  const { fetchedIds } = stateUpdater;
  
  const newSnippets = posts
    .filter(post => !fetchedIds.has(post.id))  // Check if post ID exists
    .map(post => {
      const title = post.title && post.title.trim() !== "" ? post.title : "Untitled";  // Check if title exists and is not empty
      const body = post.body && post.body.trim() !== "" 
        ? (post.body.length > 100 ? post.body.substring(0, 100) + '...' : post.body)  // Check if body exists and handle truncation
        : "No content available";  // Default content if body is missing or empty
      
      // Add the new post ID to the fetched IDs
      fetchedIds.add(post.id);
      
      return { title, body };
    });
    
  return newSnippets;
}

const exampleBlock = createComponent<
  IntegrationBlockProps,
  IntegrationBlockState,
  IntegrationAction,
  IntegrationContext
>({
  componentId: "labautomation.io",
  initialState: (props) => {
    return {
      message: "Click Me",
      snippets: [],
      fetchedIds: new Set()  // Initialize a set to track fetched post IDs
    };
  },
  action: async (element, action, context) => {
    switch (action.action) {
      case "click":
        const response = await fetch('https://labautomation.io/posts.json');
        const data = await response.json();
        const newSnippets = createSnippets(data, element.state);

        // Update the state with new snippets if there are any
        if (newSnippets.length > 0) {
          return {
            state: {
              message: "Data Loaded",
              snippets: [...element.state.snippets, ...newSnippets]  // Append new snippets
            }
          };
        }
    }
  },
  render: async (element, context) => {
    return (
      <block>
        <button label={element.state.message} onPress={{ action: "click" }} />
        {element.state.snippets.map((snippet, index) => (
          <box key={index}>
            <text>{snippet.title}</text>
            <text>{snippet.body}</text>
          </box>
        ))}
      </block>
    );
  },
});

export default createIntegration({
  fetch: handleFetchEvent,
  components: [exampleBlock],
  events: {
    // Start periodic fetch when the component is mounted
    mounted: (context) => {
      startPeriodicFetch(context.updateState);
    }
  },
});
