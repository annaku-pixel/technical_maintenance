'use strict';
const app = require('./controllers/app');
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Вебзастосунок: http://localhost:${port}`));
