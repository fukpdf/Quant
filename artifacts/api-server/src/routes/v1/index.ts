import { Router, type IRouter } from "express";
import marketsRouter from "./markets";
import candlesRouter from "./candles";
import latestPriceRouter from "./latest-price";
import ingestionStatusRouter from "./ingestion-status";

const v1Router: IRouter = Router();

v1Router.use(marketsRouter);
v1Router.use(candlesRouter);
v1Router.use(latestPriceRouter);
v1Router.use(ingestionStatusRouter);

export default v1Router;
