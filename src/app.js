import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";
import dayjs from "dayjs";
pg.types.setTypeParser(1082, (str) => str);

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

app.get("/customers", async (req, res) => {
  try {
    let customers;
    let cpfQuery = req.query.cpf;
    if (cpfQuery !== undefined) {
      cpfQuery = cpfQuery + "%";
      customers = await connection.query(
        `
        SELECT * FROM customers
        ${cpfQuery !== undefined ? `WHERE cpf ILIKE $1` : ""}
        `,
        [cpfQuery]
      );
    } else {
      customers = await connection.query(
        `
        SELECT * FROM customers
        `
      );
    }

    res.send(customers.rows);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});
app.get("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await connection.query(
      `SELECT * FROM customers WHERE customers.id = $1`,
      [id]
    );
    if (customer.rowCount === 0) {
      return res.sendStatus(404);
    }
    res.send(customer.rows); //Esta sem parseInt
  } catch {
    res.sendStatus(500);
  }
});

app.post("/customers", async (req, res) => {
  try {
    const customerSchema = Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().pattern(/[0-9]/).required().min(10).max(11),
      cpf: Joi.string().pattern(/[0-9]/).min(11).max(11),
      birthday: Joi.string().pattern(/^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/),
    });
    const { name, phone, cpf, birthday } = await customerSchema.validateAsync(
      req.body
    );
    const sameCpf = await connection.query(
      `SELECT cpf FROM customers WHERE cpf = $1`,
      [cpf]
    );
    if (sameCpf.rowCount > 0) {
      res.sendStatus(409);
    }
    await connection.query(
      `INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)`,
      [name, phone, cpf, birthday]
    );
    res.sendStatus(201);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});
app.put("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const costumerSchema = Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().pattern(/[0-9]/).required().min(10).max(11),
      cpf: Joi.string().pattern(/[0-9]/).min(11).max(11),
      birthday: Joi.string().pattern(/^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/),
    });
    const { name, phone, cpf, birthday } = await customerSchema.validateAsync(
      req.body
    );
    const sameCpf = await connection.query(
      `SELECT cpf FROM customers WHERE cpf = $1 AND id <> $2`,
      [cpf, id]
    );
    if (sameCpf.rowCount > 0) {
      res.sendStatus(409);
    }
    await connection.query(
      `UPDATE customers SET name = $1, phone = $2, birthday = $3 WHERE = cpf = $4`,
      [name, phone, birthday, cpf]
    );
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});
app.get("/rentals", async (req, res) => {
  try {
    const rentals = await connection.query("SELECT * FROM rentals");
    res.send(rentals.rows);
  } catch {
    res.sendStatus(500);
  }
});
app.post("/rentals", async (req, res) => {
  try {
    const rental = req.body;
    const validationCustomer = await connection.query(
      `
    SELECT id FROM customers WHERE id = $1
    `,
      [req.body.customerId]
    );
    const validationGame = await connection.query(
      `
    SELECT id FROM games WHERE id = $1
    `,
      [req.body.gameId]
    );
    if (
      validationCustomer.rowCount === 0 ||
      validationGame.rowCount === 0 ||
      req.body.daysRented === 0
    ) {
      return sendStatus(400);
    }
    rental.rentDate = dayjs().format("YYYY-MM-DD");
    rental.returnDate = null;
    rental.delayFee = null;
    const price = await connection.query(
      `
      SELECT * FROM games WHERE id = $1
    `,
      [rental.gameId]
    );
    rental.originalPrice =
      rental.daysRented * parseInt(price.rows[0].pricePerDay);
    await connection.query(
      `INSERT INTO rentals 
      ("customerId", "gameId", "daysRented", "rentDate", "returnDate", "delayFee", "originalPrice") 
      VALUES($1, $2, $3, $4, $5, $6, $7)`,
      [
        rental.customerId,
        rental.gameId,
        rental.daysRented,
        rental.rentDate,
        rental.returnDate,
        rental.delayFee,
        rental.originalPrice,
      ]
    );

    res.send(rental);
  } catch {
    res.sendStatus(400);
  }
});
app.listen(4000, () => {
  console.log("Server running");
});
