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
    divisa_total,
    divisa_senia,
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

    // 2. Verificar solapamiento de fechas con reservas CONFIRMADAS
    const { data: overlapping, error: overlapError } = await supabase
      .from('reservas')
      .select('*, clientes(nombre)')
      .eq('estado_reserva', 'confirmada')
      .lte('fecha_inicio', fecha_fin)
      .gte('fecha_fin', fecha_inicio);

    if (overlapError) throw overlapError;

    if (overlapping && overlapping.length > 0) {
      const conflict = overlapping[0];
      const conflictClient = conflict.clientes ? conflict.clientes.nombre : 'Otro cliente';
      return res.status(400).json({
        error: `Conflicto de fecha: La quinta ya está alquilada (reserva confirmada) por ${conflictClient} desde el ${conflict.fecha_inicio} al ${conflict.fecha_fin}.`,
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
          divisa_total: divisa_total || 'ARS',
          divisa_senia: divisa_senia || 'ARS',
          estado_pago: estado_pago || 'pendiente',
          estado_reserva: estado_reserva || 'pre-reserva',
          notas,
        },
      ])
      .select('*, clientes(*)');

    if (insertError) throw insertError;

    const reserva = newReserva[0];

    // 3b. Si requiere visita previa, crear la visita vinculada
    if (req.body.requiere_visita && req.body.fecha_hora_visita) {
      const { error: visitError } = await supabase
        .from('visitas')
        .insert([
          {
            cliente_id,
            nombre_visitante: null,
            fecha_hora_visita: req.body.fecha_hora_visita,
            motivo: req.body.motivo_visita || 'Conocer la quinta (Visita Previa)',
            notas: req.body.notas_visita || '',
            reserva_id: reserva.id
          }
        ]);
      if (visitError) throw visitError;
    }

    // 4. Si hay seña y se inserta directo (ej. ya confirmada), crear transacción
    if (monto_senia > 0) {
      await supabase.from('transacciones').insert([
        {
          tipo: 'ingreso',
          monto: monto_senia,
          divisa: divisa_senia || 'ARS',
          categoria: 'reserva_senia',
          fecha: fecha_inicio,
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
    divisa_total,
    divisa_senia,
    estado_pago,
    estado_reserva,
    notas,
  } = req.body;

  try {
    // Obtener estado anterior
    const { data: oldReserva, error: getOldError } = await supabase
      .from('reservas')
      .select('*, clientes(nombre)')
      .eq('id', id)
      .single();

    if (getOldError) throw getOldError;

    const newEstadoReserva = estado_reserva !== undefined ? estado_reserva : oldReserva.estado_reserva;
    const newFechaInicio = fecha_inicio || oldReserva.fecha_inicio;
    const newFechaFin = fecha_fin || oldReserva.fecha_fin;

    // 1. Verificar solapamiento de fechas con reservas CONFIRMADAS
    if (newEstadoReserva === 'confirmada') {
      const { data: overlapping, error: overlapError } = await supabase
        .from('reservas')
        .select('*, clientes(nombre)')
        .neq('id', id)
        .eq('estado_reserva', 'confirmada')
        .lte('fecha_inicio', newFechaFin)
        .gte('fecha_fin', newFechaInicio);

      if (overlapError) throw overlapError;

      if (overlapping && overlapping.length > 0) {
        const conflict = overlapping[0];
        const conflictClient = conflict.clientes ? conflict.clientes.nombre : 'Otro cliente';
        return res.status(400).json({
          error: `Conflicto de fecha: La quinta ya está alquilada (reserva confirmada) por ${conflictClient} desde el ${conflict.fecha_inicio} al ${conflict.fecha_fin}.`,
        });
      }
    }

    // 2. Actualizar reserva
    const { data: updatedReserva, error: updateError } = await supabase
      .from('reservas')
      .update({
        fecha_inicio,
        fecha_fin,
        monto_total,
        monto_senia,
        divisa_total,
        divisa_senia,
        estado_pago,
        estado_reserva,
        notas,
      })
      .eq('id', id)
      .select('*, clientes(*)');

    if (updateError) throw updateError;

    const newReserva = updatedReserva[0];

    // 2b. Si la reserva pasa a 'confirmada', auto-cancelar todas las demás pre-reservas en ese rango
    if (newEstadoReserva === 'confirmada' && oldReserva.estado_reserva !== 'confirmada') {
      const { error: cancelError } = await supabase
        .from('reservas')
        .update({ 
          estado_reserva: 'cancelada', 
          notas: `Cancelada automáticamente por conflicto con la reserva confirmada de ${newReserva.clientes?.nombre}.` 
        })
        .neq('id', id)
        .eq('estado_reserva', 'pre-reserva')
        .lte('fecha_inicio', newFechaFin)
        .gte('fecha_fin', newFechaInicio);

      if (cancelError) {
        console.error('Error auto-cancelando pre-reservas competidoras:', cancelError);
      }
    }

    // 3. Registrar transacciones automáticas basadas en cambios de estado de pago
    if (estado_pago === 'total_pagado' && oldReserva.estado_pago !== 'total_pagado') {
      const currentDivisaTotal = divisa_total || oldReserva.divisa_total || 'ARS';
      const currentDivisaSenia = divisa_senia || oldReserva.divisa_senia || 'ARS';
      const sameDivisa = currentDivisaTotal === currentDivisaSenia;
      
      const valTotal = monto_total !== undefined ? monto_total : oldReserva.monto_total;
      const valSenia = monto_senia !== undefined ? monto_senia : oldReserva.monto_senia;
      
      const saldo = sameDivisa ? (valTotal - valSenia) : valTotal;
      if (saldo > 0) {
        await supabase.from('transacciones').insert([
          {
            tipo: 'ingreso',
            monto: saldo,
            divisa: currentDivisaTotal,
            categoria: 'reserva_saldo',
            fecha: new Date().toISOString().split('T')[0],
            reserva_id: id,
            descripcion: `Saldo liquidado por reserva de ${newReserva.clientes?.nombre || 'cliente'}`,
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
