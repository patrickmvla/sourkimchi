import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import mongoose from "mongoose";

import morgan from "morgan";
import "dotenv/config.js";

import { env } from "./env/server.js";

const app = express();

app.use(
  cors({
    credentials: true,
  })
);

//
app.use(compression());
app.use(bodyParser.json());
app.use(cookieParser());

const server = http.createServer(app);

server.listen(8080, () => {
  console.log("Server running on http://localhost:8080/");
});

mongoose.Promise = Promise;

mongoose.connect(env.MONGODB_URL);
mongoose.connection.on("error", (error: Error) => console.log(error));
