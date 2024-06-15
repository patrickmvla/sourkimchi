import mongoose, { ConnectOptions, Error } from "mongoose";
import { env } from "../env/server.js";

mongoose.set("strictQuery", true);

const connectDB = () => {
  mongoose.connection.on("connected", () => {
    if (env?.NODE_ENV && env.NODE_ENV === "development") {
      console.log("MongoDB database connection established successfully");
    }
  });

  mongoose.connection.on("reconnected", () => {
    if (env?.NODE_ENV && env.NODE_ENV === "development") {
      console.log("Mongo connection reestablished");
    }
  });

  mongoose.connection.on("error", (error: Error) => {
    if (env?.NODE_ENV && env.NODE_ENV === "development") {
      console.log(
        "Mongo connection error, please make sure MongoDB is running"
      );
      console.log(`Mongo connection ERROR: ${error}`);
    }
  });

  mongoose.connection.on("close", () => {
    if (env?.NODE_ENV && env.NODE_ENV === "development") {
      console.log("Mongo connection closed...");
    }
  });

  mongoose.connection.on("disconnected", () => {
    if (env?.NODE_ENV && env.NODE_ENV === "development") {
      console.log("Mongo connection is disconnected...");
      console.log("Trying to reconnect to Mongo...");
    }

    setTimeout(() => {
      mongoose.connect(env.MONGODB_URL, {
        keepAlive: true,
        socketTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // useFindAndModify: true,
        // useCreateIndex: true,
      } as ConnectOptions);
    }, 3000);
  });

  process.on("SIGINT", () => {
    mongoose.connection.close(() => {
      if (env?.NODE_ENV && env.NODE_ENV === "development") {
        console.log(
          "MongoDB connection is disconnected due to app termination"
        );
      }
      process.exit(0);
    });
  });

  mongoose.connect(env.MONGODB_URL, {
    keepAlive: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as ConnectOptions);

  return mongoose.connect(env.MONGODB_URL);
};

export default connectDB;
