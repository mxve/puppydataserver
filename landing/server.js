import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT, BIND_ADDR } from './src/config.js';
import { check_pds_health, refresh_stats } from './src/services/pds.js';

import authRoutes from './src/routes/auth.js';
import mainRoutes from './src/routes/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

check_pds_health();
setInterval(check_pds_health, 10_000);
refresh_stats();
setInterval(refresh_stats, 60_000);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(authRoutes);
app.use(mainRoutes);

app.listen(PORT, BIND_ADDR, () => {
  console.log(`PuppyDataServer landing running on http://${BIND_ADDR}:${PORT}`);
});
