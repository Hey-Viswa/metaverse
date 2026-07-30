import { Router } from "express";
import { client } from "@repo/db";
import bcrypt from "bcrypt";
import z from "zod";
import jwt from "jsonwebtoken";

export const userRouter = Router();

const SignupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 character"),
  password: z.string().min(6, "Password must be at least 6 character"),
});

const SigninSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const JWT_SECRET = process.env.JWT_SECRET;

userRouter.post("/signup", async (req, res, next) => {
  const parsedData = SignupSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: "Invalid input",
    });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);

    const user = await client.user.create({
      data: {
        username: parsedData.data.username,
        password: hashedPassword,
        role: "User",
      },
    });

    res.status(201).json({
      message: "User created succesfully",
      userId: user.id,
    });
  } catch (error) {
    next(error);
  }
});

userRouter.post("/signin", async (req, res) => {
  const parsedData = SigninSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  try {
    const user = await client.user.findUnique({
      where: {
        username: parsedData.data.username,
      },
    });
    if (!user) {
      res.status(403).json({
        message: "User not found ",
      });
      return;
    }
    const isValid = await bcrypt.compare(
      parsedData.data.password,
      user.password,
    );
    if (!isValid) return res.status(403).json({ message: "Invalid Password" });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string);
    res.json({
      token,
    });
  } catch (error) {
    console.error("SIGNIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
