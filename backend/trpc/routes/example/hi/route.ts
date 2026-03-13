import { publicProcedure } from "../../../create-context";

const hiRoute = publicProcedure.query(() => {
  return { message: "Hello from tRPC" };
});

export default hiRoute;
