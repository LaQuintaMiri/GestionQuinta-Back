const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Obtener transacciones
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('*, reservas(id, clientes(nombre))')
      .order('fecha', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener resumen mensual
router.get('/resumen', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('tipo, monto, fecha, categoria, divisa');

    if (error) throw error;

    // Calcular balances totales e históricos mensuales separados por divisa
    let ingresosARS = 0;
    let egresosARS = 0;
    let ingresosUSD = 0;
    let egresosUSD = 0;
    const mensual = {};

    data.forEach((tx) => {
      const monto = parseFloat(tx.monto);
      const divisa = tx.divisa || 'ARS';
      const fechaObj = new Date(tx.fecha);
      const mesKey = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`;

      if (!mensual[mesKey]) {
        mensual[mesKey] = { 
          ingresosARS: 0, egresosARS: 0, balanceARS: 0,
          ingresosUSD: 0, egresosUSD: 0, balanceUSD: 0
        };
      }

      if (divisa === 'USD') {
        if (tx.tipo === 'ingreso') {
          ingresosUSD += monto;
          mensual[mesKey].ingresosUSD += monto;
        } else {
          egresosUSD += monto;
          mensual[mesKey].egresosUSD += monto;
        }
        mensual[mesKey].balanceUSD = mensual[mesKey].ingresosUSD - mensual[mesKey].egresosUSD;
      } else {
        if (tx.tipo === 'ingreso') {
          ingresosARS += monto;
          mensual[mesKey].ingresosARS += monto;
        } else {
          egresosARS += monto;
          mensual[mesKey].egresosARS += monto;
        }
        mensual[mesKey].balanceARS = mensual[mesKey].ingresosARS - mensual[mesKey].egresosARS;
      }
    });

    res.json({
      resumenGeneral: {
        ingresosARS,
        egresosARS,
        balanceARS: ingresosARS - egresosARS,
        ingresosUSD,
        egresosUSD,
        balanceUSD: ingresosUSD - egresosUSD
      },
      resumenMensual: mensual,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear transacción
router.post('/', async (req, res) => {
  const { tipo, monto, divisa, categoria, fecha, reserva_id, descripcion } = req.body;

  if (!tipo || !monto || !categoria) {
    return res.status(400).json({ error: 'Tipo, monto y categoría son obligatorios.' });
  }

  try {
    const { data, error } = await supabase
      .from('transacciones')
      .insert([
        {
          tipo,
          monto,
          divisa: divisa || 'ARS',
          categoria,
          fecha: fecha || new Date().toISOString().split('T')[0],
          reserva_id: reserva_id || null,
          descripcion,
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar transacción
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { tipo, monto, categoria, fecha, reserva_id, descripcion } = req.body;
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .update({ tipo, monto, categoria, fecha, reserva_id, descripcion })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar transacción
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('transacciones').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Transacción eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
