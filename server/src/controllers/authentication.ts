import express from "express";
import { createUser, getUserByEmail } from "../db/users.js";
import { authentication, random } from "../helpers/index.js";

export const register = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || username) {
      return res.sendStatus(400);
    }

    const existingUser = getUserByEmail(email);

    if (!existingUser) {
      return res.sendStatus(400);
    }

    const salt = random();
    const user = await createUser({
      email,
      username,
      authentication: {
        salt,
        password: authentication(salt, password),
      },
    });

    return res.status(200);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
