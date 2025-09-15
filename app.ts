import bodyParser from "body-parser";
import express from "express";
import { router as auth } from "./controllers/auth";
import { router as register } from "./controllers/register";
import { router as draw } from "./controllers/draw";

export const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/login", auth);
app.use("/register", register);
app.use("/draws", draw);

