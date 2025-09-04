import { app } from "./app";
import { conn } from "./db";

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
