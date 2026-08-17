const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir ruta raíz
app.get('/', (req, res) => {
  res.send('Servidor API de Gestión de Quinta en funcionamiento 🏡🚀');
});

// Importar rutas
const clientesRouter = require('./routes/clientes');
const visitasRouter = require('./routes/visitas');
const reservasRouter = require('./routes/reservas');
const transaccionesRouter = require('./routes/transacciones');
const plantillasRouter = require('./routes/plantillas');

// Montar rutas
app.use('/api/clientes', clientesRouter);
app.use('/api/visitas', visitasRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/transacciones', transaccionesRouter);
app.use('/api/plantillas', plantillasRouter);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Ha ocurrido un error interno en el servidor.' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});
