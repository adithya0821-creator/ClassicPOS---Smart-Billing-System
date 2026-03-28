import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Database Configuration
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const supabase = useSupabase 
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  : null;

let sqliteDb: any = null;

async function initDatabase() {
  if (!useSupabase) {
    try {
      const { default: Database } = await import("better-sqlite3");
      sqliteDb = new Database("pos.db");

      // Initialize SQLite database
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          unitPrice REAL NOT NULL,
          category TEXT NOT NULL,
          stock INTEGER NOT NULL DEFAULT 0
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
          address TEXT
        );
      `);

      // Migration: Add paymentMethod to bills if it doesn't exist
      const tableInfo = sqliteDb.prepare("PRAGMA table_info(bills)").all() as any[];
      const hasPaymentMethod = tableInfo.some((col: any) => col.name === "paymentMethod");
      if (!hasPaymentMethod) {
        sqliteDb.exec("ALTER TABLE bills ADD COLUMN paymentMethod TEXT NOT NULL DEFAULT 'UPI'");
      }

      // Migration: Add stock to products if it doesn't exist
      const productTableInfo = sqliteDb.prepare("PRAGMA table_info(products)").all() as any[];
      const hasStock = productTableInfo.some((col: any) => col.name === "stock");
      if (!hasStock) {
        sqliteDb.exec("ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0");
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

        const insertProduct = sqliteDb.prepare("INSERT INTO products (id, name, unitPrice, category, stock) VALUES (?, ?, ?, ?, ?)");
        const initialProducts = [
          ["p1", "Milk (1L)", 60, "Dairy", 100],
          ["p2", "Bread (400g)", 45, "Bakery Items", 50],
          ["p3", "Eggs (12pcs)", 90, "Dairy", 30],
          ["p4", "Rice (1kg)", 80, "Grains", 200],
          ["p5", "Sugar (1kg)", 50, "Grains", 150],
          ["p6", "Tea Powder (250g)", 120, "Beverages", 80],
          ["p7", "Coffee (100g)", 250, "Beverages", 40],
          ["p8", "Apple (1kg)", 180, "Fruits", 60],
          ["p9", "Banana (1 doz)", 60, "Fruits", 100],
          ["p10", "Tomato (1kg)", 40, "Vegetables", 120],
          ["p11", "Vanilla Ice Cream (500ml)", 150, "Ice Creams", 25],
          ["p12", "Chocolate Cake (500g)", 450, "Cakes", 15],
          ["p13", "Strawberry Shake", 120, "Shakes", 40],
          ["p14", "Potato (1kg)", 30, "Vegetables", 200],
          ["p15", "Onion (1kg)", 35, "Vegetables", 180],
          ["p16", "Butter (200g)", 110, "Dairy", 45],
          ["p17", "Cheese Slices (10pcs)", 160, "Dairy", 35],
          ["p18", "Orange Juice (1L)", 95, "Beverages", 55],
          ["p19", "Mango (1kg)", 120, "Fruits", 70],
          ["p20", "Cookies (200g)", 65, "Bakery Items", 90],
        ];
        initialProducts.forEach(p => insertProduct.run(...p));
      }
    } catch (err) {
      console.error("Failed to initialize SQLite:", err);
    }
  }
}

// Initialize database
await initDatabase();

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
  const { id, name, unitPrice, category, stock } = req.body;
  if (useSupabase) {
    const { error } = await supabase!.from("products").insert([{ id, name, unit_price: unitPrice, category, stock: stock || 0 }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, id });
  } else {
    try {
      const insert = sqliteDb!.prepare("INSERT INTO products (id, name, unitPrice, category, stock) VALUES (?, ?, ?, ?, ?)");
      insert.run(id, name, unitPrice, category, stock || 0);
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: "Failed to add product" });
    }
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, unitPrice, category, stock } = req.body;
  if (!name || unitPrice === undefined || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (useSupabase) {
    const { error } = await supabase!.from("products").update({ name, unit_price: unitPrice, category, stock }).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } else {
    try {
      const result = sqliteDb!.prepare("UPDATE products SET name = ?, unitPrice = ?, category = ?, stock = ? WHERE id = ?").run(name, unitPrice, category, stock || 0, id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
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
    if (error) {
      if (error.message.includes("Could not find the table")) {
        return res.status(500).json({ 
          error: "Supabase tables are not set up. Please run the required SQL in your Supabase SQL Editor.",
          sql: `
            CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
            CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit_price REAL NOT NULL, category TEXT NOT NULL);
            CREATE TABLE bills (billId TEXT PRIMARY KEY, subtotal REAL NOT NULL, tax REAL NOT NULL, discount REAL NOT NULL, totalAmount REAL NOT NULL, timestamp TEXT NOT NULL, paymentStatus TEXT NOT NULL, paymentMethod TEXT NOT NULL DEFAULT 'UPI', customerName TEXT, customerPhone TEXT);
            CREATE TABLE bill_items (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, billId TEXT NOT NULL REFERENCES bills(billId), productId TEXT NOT NULL, productName TEXT NOT NULL, quantity INTEGER NOT NULL, unitPrice REAL NOT NULL, totalCost REAL NOT NULL);
            CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, address TEXT);
          `
        });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.json(data);
  } else {
    const categories = sqliteDb!.prepare("SELECT * FROM categories").all();
    res.json(categories);
  }
});

app.post("/api/categories", async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "ID and Name are required" });
  }
  if (useSupabase) {
    const { error } = await supabase!.from("categories").insert([{ id, name }]);
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: "Category already exists" });
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true, id });
  } else {
    try {
      sqliteDb!.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(id, name);
      res.json({ success: true, id });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Category already exists" });
      }
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
  const { id, name, phone, address } = req.body;
  if (useSupabase) {
    const { error } = await supabase!.from("customers").insert([{ id, name, phone, address }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, id });
  } else {
    try {
      const insert = sqliteDb!.prepare("INSERT INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)");
      insert.run(id, name, phone, address);
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: "Failed to add customer" });
    }
  }
});

app.get("/api/bills", async (req, res) => {
  if (useSupabase) {
    const { data: bills, error: billsError } = await supabase!.from("bills").select("*").order("timestamp", { ascending: false });
    if (billsError) return res.status(500).json({ error: billsError.message });
    
    // Fetch items for each bill
    const { data: items, error: itemsError } = await supabase!.from("bill_items").select("*");
    if (itemsError) return res.status(500).json({ error: itemsError.message });

    const billsWithItems = bills.map(bill => ({
      ...bill,
      items: items.filter(item => item.bill_id === bill.bill_id).map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalCost: item.total_cost
      }))
    }));
    
    return res.json(billsWithItems);
  } else {
    const bills = sqliteDb!.prepare("SELECT * FROM bills ORDER BY timestamp DESC").all() as any[];
    const billsWithItems = bills.map(bill => {
      const items = sqliteDb!.prepare("SELECT * FROM bill_items WHERE billId = ?").all(bill.billId);
      return { ...bill, items };
    });
    res.json(billsWithItems);
  }
});

app.post("/api/bills", async (req, res) => {
  const { billId, items, subtotal, tax, discount, totalAmount, timestamp, paymentStatus, paymentMethod, customerName, customerPhone } = req.body;
  
  if (!customerPhone || customerPhone.trim() === '') {
    return res.status(400).json({ error: "Phone number is mandatory to generate a bill" });
  }

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

    // Decrement stock in Supabase
    for (const item of items) {
      const { data: product } = await supabase!.from("products").select("stock").eq("id", item.productId).single();
      if (product) {
        await supabase!.from("products").update({ stock: Math.max(0, product.stock - item.quantity) }).eq("id", item.productId);
      }
    }

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

    const updateStock = sqliteDb!.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?");

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
          updateStock.run(item.quantity, item.productId);
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

app.get("/api/reports", async (req, res) => {
  const { from, to } = req.query;
  
  if (useSupabase) {
    let billsQuery = supabase!.from("bills").select("*, bill_items(*)");
    if (from) billsQuery = billsQuery.gte("timestamp", from);
    if (to) billsQuery = billsQuery.lte("timestamp", to);
    
    const { data: bills, error } = await billsQuery;
    if (error) return res.status(500).json({ error: error.message });

    const { data: products } = await supabase!.from("products").select("*");
    
    res.json({ bills, products });
  } else {
    let billsQuery = "SELECT * FROM bills";
    const params: any[] = [];
    if (from || to) {
      billsQuery += " WHERE";
      if (from) {
        billsQuery += " timestamp >= ?";
        params.push(from);
      }
      if (to) {
        if (from) billsQuery += " AND";
        billsQuery += " timestamp <= ?";
        params.push(to);
      }
    }
    
    const bills = sqliteDb!.prepare(billsQuery).all(...params) as any[];
    const billsWithItems = bills.map(bill => {
      const items = sqliteDb!.prepare("SELECT * FROM bill_items WHERE billId = ?").all(bill.billId);
      return { ...bill, bill_items: items };
    });
    
    const products = sqliteDb!.prepare("SELECT * FROM products").all();
    
    res.json({ bills: billsWithItems, products });
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

// Vite/Static setup
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

await setupFrontend();

// Only listen if not running as a serverless function (Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database mode: ${useSupabase ? "Supabase" : "SQLite"}`);
  });
}

export default app;
