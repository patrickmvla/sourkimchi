import express from "express";
import { getAllUsers } from "../controllers/users.js";

export default (router: express.Router) => {
  router.get("/users", getAllUsers);
};

