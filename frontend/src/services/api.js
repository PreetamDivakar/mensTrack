import axios from "axios";
import { getProfileId } from "../utils/profile.js";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
});

export const getPrediction = () => {
  const profileId = getProfileId();
  return API.get("/predict", { params: profileId ? { profile_id: profileId } : {} });
};

export const getPatterns = () => {
  const profileId = getProfileId();
  return API.get("/patterns", { params: profileId ? { profile_id: profileId } : {} });
};

export const getCycles = () => {
  const profileId = getProfileId();
  return API.get("/cycles", { params: profileId ? { profile_id: profileId } : {} });
};

export const addCycle = (data) => {
  const profileId = getProfileId();
  return API.post("/cycles", profileId ? { ...data, profile_id: profileId } : data);
};

export const getPhases = () => {
  const profileId = getProfileId();
  return API.get("/phases", { params: profileId ? { profile_id: profileId } : {} });
};

export const getLogs = (params) => API.get("/logs", { params });

export const addLog = (data) => {
  const profileId = getProfileId();
  return API.post("/logs", profileId ? { ...data, profile_id: profileId } : data);
};
