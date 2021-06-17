import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";

const app = express();
const { Pool } = pg;

const connection = new Pool({
  user: "postgres",
  password: "123456",
  host: "localhost",
  port: 5432,
  database: "boardcamp",
});

app.use(cors());
app.use(express.json());

app.get("/categories", async (req, res) => {
  const categories = await connection.query("SELECT * FROM categories");
  res.send(categories.rows);
});

app.post("/categories", async (req, res) => {
  const categoriesSchema = Joi.object({
    name: Joi.string().required(),
  });
  try {
    const { name, err } = await categoriesSchema.validateAsync(req.body);

    const sameName = await connection.query(
      "SELECT * FROM categories WHERE name = $1",
      [name]
    );
    if (sameName.rowCount > 0) {
      return res.sendStatus(409);
    }
    await connection.query("INSERT INTO categories (name) VALUES ($1)", [name]);
    res.sendStatus(201);
  } catch (err) {
    res.sendStatus(400);
    console.log(err);
  }
});

app.listen(4000, () => {
  console.log("Server running");
});
