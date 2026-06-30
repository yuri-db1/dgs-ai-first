import { app } from "@azure/functions";
import { feedbackHandler } from "./handler";

// Register the feedback endpoint with the Azure Functions v4 programming model.
// Kept separate from handler.ts so importing the handler (e.g. in tests) has no
// host-registration side effect. The handler uses its default Cosmos store here.
app.http("feedback", {
  methods: ["POST"],
  authLevel: "function",
  route: "feedback",
  handler: (request, context) => feedbackHandler(request, context),
});
