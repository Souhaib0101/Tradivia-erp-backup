import 'dotenv/config';
export const env={port:Number(process.env.PORT??3001),databasePath:process.env.DATABASE_PATH??'./data/tradivia.db',jwtSecret:process.env.JWT_SECRET??'development-only-secret',corsOrigin:process.env.CORS_ORIGIN??'http://localhost:5173',documentWorkerPath:process.env.DOCUMENT_WORKER_PATH??'../../workers/documents'};
