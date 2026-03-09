import { MongoClient } from "mongodb";

let client;
let db;

export async function connectToMongo() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  client = new MongoClient(uri);
  await client.connect();

  db = client.db(); // uses DB name from URI
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  console.log("Connected to MongoDB");

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectToMongo() first.");
  }

  return db;
}
