import {auth} from "express-oauth2-jwt-bearer"
import { Request, Response, NextFunction } from "express"
import { Jwt } from "jsonwebtoken"
import { UserModel } from "../model/users.model.js"

export const jwtCheck = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: "RS256",
})

export const 