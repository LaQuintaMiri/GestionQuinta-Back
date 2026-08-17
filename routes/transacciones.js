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
      .select('tipo, monto, fecha, categoria');

    if (error) throw error;

    // Calcular balances totales e históricos mensuales
    let totalIngresos = 0;
    let totalEgresos = 0;
    const mensual = {};

    data.forEach((tx) => {
      const monto = parseFloat(tx.monto);
      const fechaObj = new Date(tx.fecha);
      const mesKey = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`;

      if (!mensual[mesKey]) {
        mensual[mesKey] = { ingresos: 0, egresos: 0, balance: 0 };
      }

      if (tx.tipo === 'ingreso') {
        totalIngresos += monto;
        mensual[mesKey].ingresos += monto;
      } else {
        totalEgresos += monto;
        mensual[mesKey].egresos += monto;
      }
      mensual[mesKey].balance = mensual[mesKey].ingresos - mensual[mesKey].egresos;
    });

    res.json({
      resumenGeneral: {
        ingresos: totalIngresos,
        egresos: totalEgresos,
        balance: totalIngresos - totalEgresos,
      },
      resumenMensual: mensual,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear transacción
router.post('/', async (req, res) => {
  const { tipo, monto, categoria, fecha, reserva_id, descripcion } = req.body;

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
