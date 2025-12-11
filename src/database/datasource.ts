import { config } from 'dotenv';
config();

import { dataSource } from '../config/database.config';
export default dataSource();
