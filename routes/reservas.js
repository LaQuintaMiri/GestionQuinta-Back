const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Helper para buscar o crear cliente
async function findOrCreateClient({ nombre, telefono, email }) {
  if (!nombre) return null;

  let query = supabase.from('clientes').select('id');
  if (telefono) {
    query = query.or(`nombre.eq."${nombre}",telefono.eq."${telefono}"`);
  } else {
    query = query.eq('nombre', nombre);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    return data[0].id;
  }

  const { data: newClient, error: createError } = await supabase
    .from('clientes')
    .insert([{ nombre, telefono, email }])
    .select();

  if (createError) throw createError;
  return newClient[0].id;
}

// Obtener reservas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .select('*, clientes(*)')
      .order('fecha_inicio', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear reserva
router.post('/', async (req, res) => {
  let {
    cliente_id,
    nombre,
    telefono,
    email,
    fecha_inicio,
    fecha_fin,
    monto_total,
    monto_senia,
    estado_pago,
    estado_reserva,
    notas,
  } = req.body;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias.' });
  }

  try {
    // 1. Buscar o crear cliente si se provee nombre
    if (!cliente_id && nombre) {
      cliente_id = await findOrCreateClient({ nombre, telefono, email });
    }

    if (!cliente_id) {
      return res.status(400).json({ error: 'Debes seleccionar un cliente o cargar un nombre.' });
    }

    // 2. Verificar solapamiento de fechas con reservas activas (no canceladas)
    const { data: overlapping, error: overlapError } = await supabase
      .from('reservas')
      .select('*, clientes(nombre)')
      .neq('estado_reserva', 'cancelada')
      .lte('fecha_inicio', fecha_fin)
      .gte('fecha_fin', fecha_inicio);

    if (overlapError) throw overlapError;

    if (overlapping && overlapping.length > 0) {
      const conflict = overlapping[0];
      const conflictClient = conflict.clientes ? conflict.clientes.nombre : 'Otro cliente';
      return res.status(400).json({
        error: `Conflicto de fecha: La quinta ya está reservada por ${conflictClient} desde el ${conflict.fecha_inicio} al ${conflict.fecha_fin}.`,
      });
    }

    // 3. Crear reserva
    const { data: newReserva, error: insertError } = await supabase
      .from('reservas')
      .insert([
        {
          cliente_id,
          fecha_inicio,
          fecha_fin,
          monto_total: monto_total || 0,
          monto_senia: monto_senia || 0,
          estado_pago: estado_pago || 'pendiente',
          estado_reserva: estado_reserva || 'pre-reserva',
          notas,
        },
      ])
      .select('*, clientes(*)');

    if (insertError) throw insertError;

    const reserva = newReserva[0];

    // 4. Si hay seña, crear transacción de ingreso de forma automática
    if (monto_senia > 0) {
      await supabase.from('transacciones').insert([
        {
          tipo: 'ingreso',
          monto: monto_senia,
          categoria: 'reserva_senia',
          fecha: fecha_inicio, // se registra con fecha de reserva
          reserva_id: reserva.id,
          descripcion: `Seña recibida por reserva de ${reserva.clientes.nombre}`,
        },
      ]);
    }

    res.status(201).json(reserva);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar reserva
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    fecha_inicio,
    fecha_fin,
    monto_total,
    monto_senia,
    estado_pago,
    estado_reserva,
    notas,
  } = req.body;

  try {
    // 1. Verificar solapamiento de fechas con reservas activas excluyendo la actual
    if (fecha_inicio && fecha_fin) {
      const { data: overlapping, error: overlapError } = await supabase
        .from('reservas')
        .select('*, clientes(nombre)')
        .neq('id', id)
        .neq('estado_reserva', 'cancelada')
        .lte('fecha_inicio', fecha_fin)
        .gte('fecha_fin', fecha_inicio);

      if (overlapError) throw overlapError;

      if (overlapping && overlapping.length > 0) {
        const conflict = overlapping[0];
        const conflictClient = conflict.clientes ? conflict.clientes.nombre : 'Otro cliente';
        return res.status(400).json({
          error: `Conflicto de fecha: La quinta ya está reservada por ${conflictClient} desde el ${conflict.fecha_inicio} al ${conflict.fecha_fin}.`,
        });
      }
    }

    // Obtener estado anterior para ver si cambió el estado de pago o seña
    const { data: oldReserva, error: getOldError } = await supabase
      .from('reservas')
      .select('*, clientes(nombre)')
      .eq('id', id)
      .single();

    if (getOldError) throw getOldError;

    // 2. Actualizar reserva
    const { data: updatedReserva, error: updateError } = await supabase
      .from('reservas')
      .update({
        fecha_inicio,
        fecha_fin,
        monto_total,
        monto_senia,
        estado_pago,
        estado_reserva,
        notas,
      })
      .eq('id', id)
      .select('*, clientes(*)');

    if (updateError) throw updateError;

    const newReserva = updatedReserva[0];

    // 3. Registrar transacciones automáticas basadas en cambios de estado
    // Transacción por saldo: si pasa de 'pendiente' o 'senia_pagada' a 'total_pagado'
    if (estado_pago === 'total_pagado' && oldReserva.estado_pago !== 'total_pagado') {
      const saldo = (monto_total || oldReserva.monto_total) - (monto_senia || oldReserva.monto_senia);
      if (saldo > 0) {
        await supabase.from('transacciones').insert([
          {
            tipo: 'ingreso',
            monto: saldo,
            categoria: 'reserva_saldo',
            fecha: new Date().toISOString().split('T')[0],
            reserva_id: id,
            descripcion: `Saldo liquidado por reserva de ${newReserva.clientes.nombre}`,
          },
        ]);
      }
    }

    res.json(newReserva);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar reserva
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('reservas').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Reserva eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
