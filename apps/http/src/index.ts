import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import express from "express";
import cors from "cors";
import { userRouter } from "./routes/v1/user.js";

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();
router.use("/user", userRouter);

// Global /api/v1 router prefix
app.use("/api/v1", router);

app.listen(3000, () => {
  console.log("🚀 HTTP State Engine listening on port 3000");
});
