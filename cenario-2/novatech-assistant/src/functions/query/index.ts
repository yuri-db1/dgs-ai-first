import { app } from "@azure/functions";
import { queryHandler } from "./handler";

// Register the query endpoint with the Azure Functions v4 programming model.
// Kept separate from handler.ts so importing the handler (e.g. in tests) has no
// host-registration side effect.
app.http("query", {
  methods: ["POST"],
  authLevel: "function",
  route: "query",
  handler: queryHandler,
});
