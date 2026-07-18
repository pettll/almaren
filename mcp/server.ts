import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { registerActionTool } from "./tools/action";
import { registerObserveTool } from "./tools/observe";
import { registerProposeChangeTool } from "./tools/proposeChange";
import { registerReadFileTool } from "./tools/readFile";
import { registerSearchRepoTool } from "./tools/searchRepo";

async function main() {
  const config = loadConfig();

  const server = new McpServer({ name: "almaren", version: "1.0.0" });

  registerObserveTool(server, config);
  registerActionTool(server, config);
  registerReadFileTool(server, config);
  registerSearchRepoTool(server, config);
  registerProposeChangeTool(server, config);

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
