const {
  MongoClient,
  ServerApiVersion
} = require("mongodb");

const readUri = process.env.MONGO_READ_URI;
const writeUri = process.env.MONGO_WRITE_URI;
const dbName = process.env.DB_NAME;

if (!readUri) {
  throw new Error("MONGO_READ_URI is missing in .env");
}

if (!writeUri) {
  throw new Error("MONGO_WRITE_URI is missing in .env");
}

if (!dbName) {
  throw new Error("DB_NAME is missing in .env");
}

// --------------------------------------------------
// MongoDB options
// --------------------------------------------------

const clientOptions = {
  maxPoolSize: 5,
  minPoolSize: 0,

  // IPv4 only
  autoSelectFamily: false,

  // MongoDB Atlas requires TLS
  tls: true,

  // Timeouts
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,

  // Retry safe reads
  retryReads: true,

  // Retry writes
  retryWrites: true,

  // Stable API
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
};

// --------------------------------------------------
// MongoDB clients
// --------------------------------------------------

const readClient = new MongoClient(
  readUri,
  clientOptions
);

const writeClient = new MongoClient(
  writeUri,
  clientOptions
);

let readDb = null;
let writeDb = null;

let connected = false;

// --------------------------------------------------
// Delay helper
// --------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// --------------------------------------------------
// Connect one client with retry
// --------------------------------------------------

async function connectWithRetry(client, label) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `${label}: connection attempt ${attempt}/${maxAttempts}`
      );

      await client.connect();

      console.log(`${label}: MongoDB client connected`);

      return;
    } catch (error) {
      console.error(
        `${label}: connection attempt ${attempt} failed`
      );

      console.error(error.message);

      if (attempt === maxAttempts) {
        throw error;
      }

      const waitMs = attempt * 2000;

      console.log(
        `${label}: retrying in ${waitMs / 1000}s...`
      );

      await delay(waitMs);
    }
  }
}

// --------------------------------------------------
// Connect databases
// --------------------------------------------------

async function connectDatabases() {
  try {
    console.log("Connecting READ user...");

    await connectWithRetry(
      readClient,
      "READ"
    );

    readDb = readClient.db(dbName);

    await readDb.command({
      ping: 1
    });

    console.log("MongoDB READ connected");
    console.log(`READ database: ${dbName}`);

    console.log("Connecting WRITE user...");

    await connectWithRetry(
      writeClient,
      "WRITE"
    );

    writeDb = writeClient.db(dbName);

    await writeDb.command({
      ping: 1
    });

    console.log("MongoDB WRITE connected");
    console.log(`WRITE database: ${dbName}`);

    connected = true;
  } catch (error) {
    connected = false;

    console.error("MongoDB connection failed:");
    console.error(error);

    throw error;
  }
}

// --------------------------------------------------
// Get READ database
// --------------------------------------------------

function getReadDb() {
  if (!readDb) {
    throw new Error(
      "READ database is not connected"
    );
  }

  return readDb;
}

// --------------------------------------------------
// Get WRITE database
// --------------------------------------------------

function getWriteDb() {
  if (!writeDb) {
    throw new Error(
      "WRITE database is not connected"
    );
  }

  return writeDb;
}

// --------------------------------------------------
// Get WRITE client
// --------------------------------------------------

function getWriteClient() {
  if (!connected) {
    throw new Error(
      "MongoDB WRITE client is not connected"
    );
  }

  return writeClient;
}

// --------------------------------------------------
// Close connections
// --------------------------------------------------

async function closeDatabases() {
  connected = false;

  await Promise.allSettled([
    readClient.close(),
    writeClient.close()
  ]);

  readDb = null;
  writeDb = null;

  console.log(
    "MongoDB connections closed"
  );
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  connectDatabases,
  getReadDb,
  getWriteDb,
  getWriteClient,
  closeDatabases
};