import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const base = process.env.BASE_URL
console.log(base);

const http = axios.create({
  baseURL: process.env.BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default http;
