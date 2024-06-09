import express from "express";
import users from "./users.js";

const router = express.Router();

export default (): express.Router => {
  users(router);
  return router;
};
