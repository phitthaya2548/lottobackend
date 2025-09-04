import bodyParser from "body-parser";
import express from "express";
import { router as auth } from "./controllers/auth";
import { router as register } from "./controllers/register";
export const app = express();
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use("/login", auth);
app.use("/register", register);
