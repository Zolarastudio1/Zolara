import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import inviteRoute from "./route/invite-user.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [process.env.FRONTEND_URL] // set your frontend origin(s)
}));
app.use(express.json());

// mount invite route
app.use("/api/invite", inviteRoute);

app.get("/", (req, res) => res.send("Invite API running"));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
