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

app.get("/games", async (req, res) => {
  try {
    const search = req.query.name;
    const games = await connection.query(
      `
    SELECT games.*, categories.name AS "categoryName" 
    FROM games JOIN categories 
    ON games."categoryId" = categories.id
    ${search ? `WHERE games.name ILIKE '%${search}%'` : ""}
    `
    );
    res.send(games.rows);
  } catch {
    res.sendStatus(500);
  }
});

app.post("/games", async (req, res) => {
  try {
    const gameSchema = Joi.object({
      name: Joi.string().required(),
      image: Joi.string().required(),
      stockTotal: Joi.number().min(1),
      pricePerDay: Joi.number().min(1),
      categoryId: Joi.number(),
    });

    const { name, image, stockTotal, pricePerDay, categoryId } =
      await gameSchema.validateAsync(req.body);

    const sameName = await connection.query(
      "SELECT * FROM games WHERE name = $1",
      [name]
    );
    const existingId = await connection.query(
      `SELECT * FROM games WHERE "categoryId" = $1`,
      [categoryId]
    );
    if (sameName.rowCount > 0) {
      return res.sendStatus(409);
    } else if (existingId.rows.length === 0) {
      return res.sendStatus(400);
    }
    await connection.query(
      `INSERT INTO games (name, image, "stockTotal", "pricePerDay", "categoryId") 
      VALUES ($1, $2, $3, $4, $5)`,
      [name, image, stockTotal, pricePerDay, categoryId]
    );

    res.sendStatus(201);
  } catch (e) {
    console.log(e);
    res.sendStatus(400);
  }
});
app.listen(4000, () => {
  console.log("Server running");
});
