(function () {
  var STORAGE_DB = "sdy_db";
  var STORAGE_SESSION = "sdy_session";
  var db = { usuarios: [], pagos: [] };
  var session = null;

  var PERMISOS = {
    administrador: {
      panel: true,
      usuarios: true,
      crearUsuario: true,
      editarUsuario: true,
      borrarUsuario: true,
      cambiarRol: true,
      operaciones: true,
      exportar: true,
      respaldo: true
    },
    operador: {
      panel: true,
      usuarios: true,
      crearUsuario: false,
      editarUsuario: false,
      borrarUsuario: false,
      cambiarRol: false,
      operaciones: false,
      exportar: true,
      respaldo: false
    },
    ciudadano: { panel: false },
    negocio: { panel: false }
  };

  function rolActual() {
    if (!session) return null;
    var u = usuarioDe(session.id);
    return u ? u.rol : null;
  }

  function puede(accion) {
    var rol = rolActual();
    return !!(PERMISOS[rol] && PERMISOS[rol][accion]);
  }

  function exigir(accion, mensaje) {
    if (puede(accion)) return true;
    alert(mensaje || "Operación rechazada. No tiene privilegios suficientes.");
    return false;
  }

  function loadDb() {
    var saved = localStorage.getItem(STORAGE_DB);
    if (saved) {
      db = JSON.parse(saved);
    } else {
      db = JSON.parse(JSON.stringify(INITIAL_DB));
      persist();
    }
    start();
  }

  function persist() {
    localStorage.setItem(STORAGE_DB, JSON.stringify(db));
  }

  function start() {
    var raw = localStorage.getItem(STORAGE_SESSION);
    if (raw) {
      session = JSON.parse(raw);
      if (puede("panel")) {
        showApp();
      } else {
        localStorage.removeItem(STORAGE_SESSION);
        session = null;
      }
    }
    fillMunicipios();
  }

  function fillMunicipios() {
    var munis = [];
    db.usuarios.forEach(function (u) {
      if (munis.indexOf(u.municipio) === -1) munis.push(u.municipio);
    });
    var sel = document.getElementById("rep-muni");
    sel.innerHTML = '<option value="">Todos los municipios</option>';
    munis.sort().forEach(function (m) {
      sel.innerHTML += "<option>" + m + "</option>";
    });
  }

  function showApp() {
    $("#login-view").addClass("hidden");
    $("#app-view").removeClass("hidden");
    $("#who-name").text(session.nombre);
    $("#who-rol").text(rolActual());
    aplicarPermisosUI();
    renderAll();
  }

  function aplicarPermisosUI() {
    $("#nuevo-usuario").toggleClass("hidden", !puede("crearUsuario"));
    $("#nav-operaciones").toggleClass("hidden", !puede("operaciones"));
    $("#json-completo").toggleClass("hidden", !puede("respaldo"));
    $("#acciones-admin").toggleClass("hidden", !puede("operaciones"));
    $("#aviso-operador").toggleClass("hidden", puede("operaciones"));
  }

  function showLogin() {
    $("#app-view").addClass("hidden");
    $("#login-view").removeClass("hidden");
  }

  $("#login-form").on("submit", function (e) {
    e.preventDefault();
    var email = $("#email").val().trim();
    var password = $("#password").val();
    var user = db.usuarios.filter(function (u) {
      return u.email === email && u.password === password;
    })[0];
    if (!user) {
      $("#login-error").text("Correo o contraseña incorrectos.");
      return;
    }
    session = { id: user.id, nombre: user.nombre, email: user.email };
    if (!puede("panel")) {
      session = null;
      $("#login-error").text("Acceso denegado. Su rol no tiene permiso para el módulo de administración.");
      return;
    }
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
    $("#login-error").text("");
    showApp();
  });

  $("#logout").on("click", function () {
    localStorage.removeItem(STORAGE_SESSION);
    session = null;
    showLogin();
  });

  $("nav button").on("click", function () {
    var view = $(this).data("view");
    if (view === "operaciones" && !exigir("operaciones", "Operación rechazada. Solo el administrador puede abrir operaciones administrativas.")) {
      return;
    }
    if (view === "exportar" && !exigir("exportar")) {
      return;
    }
    $("nav button").removeClass("active");
    $(this).addClass("active");
    $("#view-dashboard, #view-usuarios, #view-reportes, #view-exportar, #view-operaciones").addClass("hidden");
    $("#view-" + view).removeClass("hidden");
  });

  function money(n) {
    return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 });
  }

  function badge(estatus) {
    var cls = "badge";
    if (estatus === "activo" || estatus === "pagado") cls += " ok";
    else if (estatus === "pendiente" || estatus === "inactivo") cls += " warn";
    else cls += " bad";
    return '<span class="' + cls + '">' + estatus + "</span>";
  }

  function renderStats() {
    var activos = db.usuarios.filter(function (u) { return u.estatus === "activo"; }).length;
    var negocios = db.usuarios.filter(function (u) { return u.tipo === "negocio"; }).length;
    var recaudado = db.pagos.reduce(function (s, p) {
      return p.estatus === "pagado" ? s + p.monto : s;
    }, 0);
    var pendientes = db.pagos.filter(function (p) { return p.estatus === "pendiente" || p.estatus === "vencido"; }).length;
    document.getElementById("stats").innerHTML = [
      stat("Usuarios", db.usuarios.length),
      stat("Cuentas activas", activos),
      stat("Negocios", negocios),
      stat("Recaudado (simulado)", money(recaudado) + "<br><small>" + pendientes + " pagos abiertos</small>")
    ].join("");
  }

  function stat(label, value) {
    return '<div class="card stat"><span>' + label + "</span><b>" + value + "</b></div>";
  }

  function renderBars() {
    var counts = {};
    db.usuarios.forEach(function (u) {
      counts[u.municipio] = (counts[u.municipio] || 0) + 1;
    });
    var max = 1;
    Object.keys(counts).forEach(function (k) { if (counts[k] > max) max = counts[k]; });
    document.getElementById("muni-bars").innerHTML = Object.keys(counts).sort().map(function (m) {
      var pct = Math.round((counts[m] / max) * 100);
      return '<div class="bar-row"><span>' + m + '</span><span class="bar"><i style="width:' + pct + '%"></i></span> ' + counts[m] + "</div>";
    }).join("");
  }

  function usuarioDe(id) {
    return db.usuarios.filter(function (u) { return u.id === id; })[0];
  }

  function renderUsuarios() {
    var q = ($("#buscar").val() || "").toLowerCase();
    var rol = $("#filtro-rol").val();
    var rows = db.usuarios.filter(function (u) {
      var blob = (u.nombre + " " + u.email).toLowerCase();
      return blob.indexOf(q) !== -1 && (!rol || u.rol === rol);
    });
    document.getElementById("tabla-usuarios").innerHTML = rows.map(function (u) {
      var acciones = "";
      if (puede("editarUsuario")) {
        acciones += '<button class="btn secondary" data-edit="' + u.id + '">Editar</button> ';
      }
      if (puede("borrarUsuario")) {
        acciones += '<button class="btn danger" data-del="' + u.id + '">Borrar</button>';
      }
      return "<tr>" +
        "<td>" + u.nombre + "</td>" +
        "<td>" + u.email + "</td>" +
        "<td>" + u.rol + "</td>" +
        "<td>" + u.municipio + "</td>" +
        "<td>" + badge(u.estatus) + "</td>" +
        "<td>" + acciones + "</td></tr>";
    }).join("");
  }

  $("#buscar, #filtro-rol").on("input change", renderUsuarios);

  $(document).on("click", "[data-edit]", function () {
    if (!exigir("editarUsuario", "Operación rechazada. No puede editar usuarios.")) return;
    openUser(Number($(this).data("edit")));
  });

  $(document).on("click", "[data-del]", function () {
    if (!exigir("borrarUsuario", "Operación rechazada. No puede eliminar registros.")) return;
    var id = Number($(this).data("del"));
    db.usuarios = db.usuarios.filter(function (u) { return u.id !== id; });
    persist();
    renderAll();
  });

  $("#nuevo-usuario").on("click", function () {
    if (!exigir("crearUsuario", "Operación rechazada. No puede crear usuarios.")) return;
    openUser(null);
  });

  function openUser(id) {
    var u = id ? usuarioDe(id) : {
      id: "", nombre: "", email: "", password: "", rol: "ciudadano",
      telefono: "", curp: "", rfc: "", municipio: "Mérida", tipo: "ciudadano", estatus: "activo"
    };
    $("#u-id").val(u.id);
    $("#u-nombre").val(u.nombre);
    $("#u-email").val(u.email);
    $("#u-password").val("");
    $("#u-rol").val(u.rol);
    $("#u-telefono").val(u.telefono);
    $("#u-curp").val(u.curp);
    $("#u-rfc").val(u.rfc);
    $("#u-municipio").val(u.municipio);
    $("#u-tipo").val(u.tipo);
    $("#u-estatus").val(u.estatus);
    $("#modal-title").text(id ? "Editar usuario" : "Nuevo usuario");
    $("#modal-back").removeClass("hidden");
  }

  $("#cerrar-modal").on("click", function () {
    $("#modal-back").addClass("hidden");
  });

  $("#user-form").on("submit", function (e) {
    e.preventDefault();
    var id = $("#u-id").val();
    if (id && !exigir("editarUsuario")) return;
    if (!id && !exigir("crearUsuario")) return;
    var actual = id ? usuarioDe(Number(id)) : null;
    var nuevoRol = $("#u-rol").val();
    if (actual && actual.rol !== nuevoRol && !exigir("cambiarRol", "Operación rechazada. No puede modificar roles.")) {
      return;
    }
    var password = $("#u-password").val();
    if (!id && !password) {
      alert("La contraseña es obligatoria al crear un usuario.");
      return;
    }
    var record = {
      id: id ? Number(id) : Date.now(),
      nombre: $("#u-nombre").val(),
      email: $("#u-email").val(),
      password: password || (actual ? actual.password : ""),
      rol: nuevoRol,
      telefono: $("#u-telefono").val(),
      curp: $("#u-curp").val(),
      rfc: $("#u-rfc").val(),
      municipio: $("#u-municipio").val(),
      tipo: $("#u-tipo").val(),
      estatus: $("#u-estatus").val(),
      registrado: actual ? actual.registrado : new Date().toISOString().slice(0, 10)
    };
    if (id) {
      db.usuarios = db.usuarios.map(function (u) { return u.id === record.id ? record : u; });
    } else {
      db.usuarios.push(record);
    }
    persist();
    $("#modal-back").addClass("hidden");
    fillMunicipios();
    renderAll();
  });

  function pagosFiltrados() {
    var est = $("#rep-estatus").val();
    var muni = $("#rep-muni").val();
    return db.pagos.filter(function (p) {
      return (!est || p.estatus === est) && (!muni || p.municipio === muni);
    });
  }

  function renderReportes() {
    var pagos = pagosFiltrados();
    var total = pagos.reduce(function (s, p) { return s + p.monto; }, 0);
    var pagado = pagos.filter(function (p) { return p.estatus === "pagado"; }).length;
    document.getElementById("rep-stats").innerHTML = [
      stat("Movimientos", pagos.length),
      stat("Monto del filtro", money(total)),
      stat("Pagados", pagado),
      stat("Usuarios en padrón", db.usuarios.length)
    ].join("");
    document.getElementById("tabla-pagos").innerHTML = pagos.map(function (p) {
      var u = usuarioDe(p.usuarioId);
      return "<tr><td>" + p.fecha + "</td><td>" + (u ? u.nombre : p.usuarioId) +
        "</td><td>" + p.servicio + "</td><td>" + p.municipio +
        "</td><td>" + money(p.monto) + "</td><td>" + badge(p.estatus) + "</td></tr>";
    }).join("");
  }

  $("#rep-estatus, #rep-muni").on("change", renderReportes);

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  function usuarioExportable(u) {
    var fila = {
      id: u.id,
      nombre: u.nombre,
      rol: u.rol,
      municipio: u.municipio,
      tipo: u.tipo,
      estatus: u.estatus
    };
    if (puede("operaciones")) {
      fila.email = u.email;
    }
    return fila;
  }

  function pagoExportable(p) {
    return {
      id: p.id,
      servicio: p.servicio,
      monto: p.monto,
      fecha: p.fecha,
      estatus: p.estatus,
      municipio: p.municipio
    };
  }

  function csvUsuarios() {
    var filas = db.usuarios.map(usuarioExportable);
    var header = Object.keys(filas[0] || { id: 1 });
    var lines = filas.map(function (u) {
      return header.map(function (k) { return u[k]; }).join(",");
    });
    return header.join(",") + "\n" + lines.join("\n");
  }

  $("#csv-usuarios").on("click", function () {
    if (!exigir("exportar", "Operación rechazada. No puede exportar datos.")) return;
    var csv = csvUsuarios();
    $("#preview-export").text(csv);
    download("usuarios-yucatan.csv", csv, "text/csv");
  });

  $("#json-pagos").on("click", function () {
    if (!exigir("exportar", "Operación rechazada. No puede exportar datos.")) return;
    var json = JSON.stringify(db.pagos.map(pagoExportable), null, 2);
    $("#preview-export").text(json);
    download("pagos-yucatan.json", json, "application/json");
  });

  $("#json-completo").on("click", function () {
    if (!exigir("respaldo", "Operación rechazada. Solo el administrador puede generar un respaldo.")) return;
    var respaldo = {
      usuarios: db.usuarios.map(usuarioExportable),
      pagos: db.pagos.map(pagoExportable)
    };
    var json = JSON.stringify(respaldo, null, 2);
    $("#preview-export").text(json);
    download("respaldo-sdy.json", json, "application/json");
  });

  function fillRolSelect() {
    document.getElementById("rol-usuario").innerHTML = db.usuarios.map(function (u) {
      return '<option value="' + u.id + '">' + u.nombre + " (" + u.rol + ")</option>";
    }).join("");
  }

  $("#activar-todos").on("click", function () {
    if (!exigir("operaciones", "Operación rechazada. Solo el administrador puede activar registros suspendidos.")) return;
    db.usuarios.forEach(function (u) {
      if (u.estatus === "suspendido") u.estatus = "activo";
    });
    persist();
    renderAll();
  });

  $("#purgar").on("click", function () {
    if (!exigir("operaciones", "Operación rechazada. Solo el administrador puede purgar registros.")) return;
    db.usuarios = db.usuarios.filter(function (u) { return u.estatus !== "inactivo"; });
    persist();
    renderAll();
  });

  $("#reset-db").on("click", function () {
    if (!exigir("operaciones", "Operación rechazada. Solo el administrador puede restaurar la base de datos.")) return;
    db = JSON.parse(JSON.stringify(INITIAL_DB));
    persist();
    fillMunicipios();
    renderAll();
  });

  $("#aplicar-rol").on("click", function () {
    if (!exigir("cambiarRol", "Operación rechazada. No puede modificar roles.")) return;
    var id = Number($("#rol-usuario").val());
    var rol = $("#rol-nuevo").val();
    db.usuarios.forEach(function (u) {
      if (u.id === id) u.rol = rol;
    });
    persist();
    renderAll();
  });

  function renderAll() {
    aplicarPermisosUI();
    renderStats();
    renderBars();
    renderUsuarios();
    renderReportes();
    fillRolSelect();
  }

  loadDb();
})();
