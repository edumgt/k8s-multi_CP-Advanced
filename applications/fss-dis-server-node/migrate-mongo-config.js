import "dotenv/config";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/adw";

// Extract database name from URI (path segment before query string)
const dbName = new URL(uri).pathname.replace(/^\//, "") || "adw";

export default {
  mongodb: {
    url: uri,
    databaseName: dbName,
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
};
