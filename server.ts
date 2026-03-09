import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Configuration
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
const supabase = useSupabase 
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  : null;

const sqliteDb = !useSupabase ? new Database("pos.db") : null;

if (sqliteDb) {
  // Initialize SQLite database
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitPrice REAL NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS bills (
      billId TEXT PRIMARY KEY,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      discount REAL NOT NULL,
      totalAmount REAL NOT NULL,
      timestamp TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      paymentMethod TEXT NOT NULL,
      customerName TEXT,
      customerPhone TEXT
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      totalCost REAL NOT NULL,
      FOREIGN KEY (billId) REFERENCES bills (billId)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      address TEXT
    );
  `);

  // Migration: Add paymentMethod to bills if it doesn't exist
  const tableInfo = sqliteDb.prepare("PRAGMA table_info(bills)").all() as any[];
  const hasPaymentMethod = tableInfo.some(col => col.name === "paymentMethod");
  if (!hasPaymentMethod) {
    sqliteDb.exec("ALTER TABLE bills ADD COLUMN paymentMethod TEXT NOT NULL DEFAULT 'UPI'");
  }

  // Seed initial products if empty
  const productCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  if (productCount.count === 0) {
    // Seed categories first
    const insertCategory = sqliteDb.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)");
    const initialCategories = [
      ["c1", "Dairy"],
      ["c2", "Bakery Items"],
      ["c3", "Grains"],
      ["c4", "Beverages"],
      ["c5", "Fruits"],
      ["c6", "Vegetables"],
      ["c7", "Ice Creams"],
      ["c8", "Cakes"],
      ["c9", "Shakes"],
    ];
    initialCategories.forEach(c => insertCategory.run(...c));

    const insertProduct = sqliteDb.prepare("INSERT INTO products (id, name, unitPrice, category) VALUES (?, ?, ?, ?)");
    const initialProducts = [
      ["p1", "Milk (1L)", 60, "Dairy"],
      ["p2", "Bread (400g)", 45, "Bakery"],
      ["p3", "Eggs (12pcs)", 90, "Dairy"],
      ["p4", "Rice (1kg)", 80, "Grains"],
      ["p5", "Sugar (1kg)", 50, "Grains"],
      ["p6", "Tea Powder (250g)", 120, "Beverages"],
      ["p7", "Coffee (100g)", 250, "Beverages"],
      ["p8", "Apple (1kg)", 180, "Fruits"],
      ["p9", "Banana (1 doz)", 60, "Fruits"],
      ["p10", "Tomato (1kg)", 40, "Vegetables"],
    ];
    initialProducts.forEach(p => insertProduct.run(...p));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/products", async (req, res) => {
    if (useSupabase) {
      const { data, error } = await supabase!.from("products").select("*");
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } else {
      const products = sqliteDb!.prepare("SELECT * FROM products").all();
      res.json(products);
    }
  });

  app.post("/api/products", async (req, res) => {
    const { id, name, unitPrice, category } = req.body;
    if (useSupabase) {
      const { error } = await supabase!.from("products").insert([{ id, name, unit_price: unitPrice, category }]);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, id });
    } else {
      try {
        const insert = sqliteDb!.prepare("INSERT INTO products (id, name, unitPrice, category) VALUES (?, ?, ?, ?)");
        insert.run(id, name, unitPrice, category);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: "Failed to add product" });
      }
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    if (useSupabase) {
      const { error } = await supabase!.from("products").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } else {
      try {
        sqliteDb!.prepare("DELETE FROM products WHERE id = ?").run(id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
    }
  });

  app.get("/api/categories", async (req, res) => {
    if (useSupabase) {
      const { data, error } = await supabase!.from("categories").select("*");
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } else {
      const categories = sqliteDb!.prepare("SELECT * FROM categories").all();
      res.json(categories);
    }
  });

  app.post("/api/categories", async (req, res) => {
    const { id, name } = req.body;
    if (useSupabase) {
      const { error } = await supabase!.from("categories").insert([{ id, name }]);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, id });
    } else {
      try {
        sqliteDb!.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(id, name);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: "Failed to add category" });
      }
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    if (useSupabase) {
      const { error } = await supabase!.from("categories").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } else {
      try {
        sqliteDb!.prepare("DELETE FROM categories WHERE id = ?").run(id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete category" });
      }
    }
  });

  app.get("/api/customers", async (req, res) => {
    if (useSupabase) {
      const { data, error } = await supabase!.from("customers").select("*");
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } else {
      const customers = sqliteDb!.prepare("SELECT * FROM customers").all();
      res.json(customers);
    }
  });

  app.post("/api/customers", async (req, res) => {
    const { id, name, phone, email, address } = req.body;
    if (useSupabase) {
      const { error } = await supabase!.from("customers").insert([{ id, name, phone, email, address }]);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, id });
    } else {
      try {
        const insert = sqliteDb!.prepare("INSERT INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)");
        insert.run(id, name, phone, email, address);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: "Failed to add customer" });
      }
    }
  });

  app.get("/api/bills", async (req, res) => {
    if (useSupabase) {
      const { data, error } = await supabase!.from("bills").select("*").order("timestamp", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } else {
      const bills = sqliteDb!.prepare("SELECT * FROM bills ORDER BY timestamp DESC").all();
      res.json(bills);
    }
  });

  app.post("/api/bills", async (req, res) => {
    const { billId, items, subtotal, tax, discount, totalAmount, timestamp, paymentStatus, paymentMethod, customerName, customerPhone } = req.body;
    
    if (useSupabase) {
      // Save customer if info provided
      if (customerPhone) {
        await supabase!.from("customers").upsert([{ 
          id: `cust-${customerPhone}`, 
          name: customerName || 'Walk-in', 
          phone: customerPhone 
        }], { onConflict: 'phone' });
      }

      const { error: billError } = await supabase!.from("bills").insert([{
        bill_id: billId,
        subtotal,
        tax,
        discount,
        total_amount: totalAmount,
        timestamp,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        customer_name: customerName,
        customer_phone: customerPhone
      }]);

      if (billError) return res.status(500).json({ error: billError.message });

      const billItems = items.map((item: any) => ({
        bill_id: billId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_cost: item.totalCost
      }));

      const { error: itemsError } = await supabase!.from("bill_items").insert(billItems);
      if (itemsError) return res.status(500).json({ error: itemsError.message });

      res.json({ success: true, billId });
    } else {
      const insertBill = sqliteDb!.prepare(`
        INSERT INTO bills (billId, subtotal, tax, discount, totalAmount, timestamp, paymentStatus, paymentMethod, customerName, customerPhone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertItem = sqliteDb!.prepare(`
        INSERT INTO bill_items (billId, productId, productName, quantity, unitPrice, totalCost)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      try {
        const transaction = sqliteDb!.transaction(() => {
          // Save customer if info provided
          if (customerPhone) {
            sqliteDb!.prepare(`
              INSERT INTO customers (id, name, phone) 
              VALUES (?, ?, ?) 
              ON CONFLICT(phone) DO UPDATE SET name=excluded.name
            `).run(`cust-${customerPhone}`, customerName || 'Walk-in', customerPhone);
          }

          insertBill.run(billId, subtotal, tax, discount, totalAmount, timestamp, paymentStatus, paymentMethod, customerName, customerPhone);
          for (const item of items) {
            insertItem.run(billId, item.productId, item.productName, item.quantity, item.unitPrice, item.totalCost);
          }
        });

        transaction();
        res.json({ success: true, billId });
      } catch (error) {
        console.error('Bill save error:', error);
        res.status(500).json({ error: "Failed to save bill" });
      }
    }
  });

  app.get("/api/bills/:id", async (req, res) => {
    if (useSupabase) {
      const { data: bill, error: billError } = await supabase!.from("bills").select("*").eq("bill_id", req.params.id).single();
      if (billError) return res.status(404).json({ error: "Bill not found" });
      
      const { data: items, error: itemsError } = await supabase!.from("bill_items").select("*").eq("bill_id", req.params.id);
      if (itemsError) return res.status(500).json({ error: itemsError.message });

      res.json({ ...bill, items });
    } else {
      const bill = sqliteDb!.prepare("SELECT * FROM bills WHERE billId = ?").get(req.params.id);
      if (!bill) return res.status(404).json({ error: "Bill not found" });
      
      const items = sqliteDb!.prepare("SELECT * FROM bill_items WHERE billId = ?").all(req.params.id);
      res.json({ ...bill, items });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database mode: ${useSupabase ? "Supabase" : "SQLite"}`);
  });
}

startServer();
