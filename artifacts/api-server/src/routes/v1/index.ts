import { Router, type IRouter } from "express";
import marketsRouter from "./markets";
import candlesRouter from "./candles";
import latestPriceRouter from "./latest-price";
import ingestionStatusRouter from "./ingestion-status";
import ingestionJobsRouter from "./ingestion-jobs";
import providersRouter from "./providers";
import marketRegistryRouter from "./market-registry";
import dataQualityRouter from "./data-quality";
import economicEventsRouter from "./economic-events";
import newsRouter from "./news";
// Phase 3 — Research Laboratory
import researchStrategiesRouter from "./research-strategies";
import researchBacktestRouter from "./research-backtest";
import researchRunsRouter from "./research-runs";
import researchResultsRouter from "./research-results";
import researchCompareRouter from "./research-compare";

const v1Router: IRouter = Router();

// Phase 1 endpoints (preserved)
v1Router.use(marketsRouter);
v1Router.use(candlesRouter);
v1Router.use(latestPriceRouter);
v1Router.use(ingestionStatusRouter);

// Phase 2 endpoints
v1Router.use(ingestionJobsRouter);
v1Router.use(providersRouter);
v1Router.use(marketRegistryRouter);
v1Router.use(dataQualityRouter);
v1Router.use(economicEventsRouter);
v1Router.use(newsRouter);

// Phase 3 endpoints
v1Router.use(researchStrategiesRouter);
v1Router.use(researchBacktestRouter);
v1Router.use(researchRunsRouter);
v1Router.use(researchResultsRouter);
v1Router.use(researchCompareRouter);

export default v1Router;
