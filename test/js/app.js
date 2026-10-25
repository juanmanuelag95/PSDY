(function () {
  var STORAGE_DB = "sdy_db";
  var STORAGE_SESSION = "sdy_session";
  var db = { usuarios: [], pagos: [] };
  var session = null;

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
      showApp();
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
    $("#who-rol").text(session.rol);
    renderAll();
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
    // No se valida el rol: cualquier cuenta entra al panel administrativo.
    session = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
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
      var blob = (u.nombre + u.email + u.curp).toLowerCase();
      return blob.indexOf(q) !== -1 && (!rol || u.rol === rol);
    });
    document.getElementById("tabla-usuarios").innerHTML = rows.map(function (u) {
      return "<tr>" +
        "<td>" + u.nombre + "<br><small>" + u.curp + " · " + u.rfc + "</small></td>" +
        "<td>" + u.email + "<br><small>" + u.telefono + "</small></td>" +
        "<td>" + u.rol + "</td>" +
        "<td>" + u.municipio + "</td>" +
        "<td>" + badge(u.estatus) + "</td>" +
        "<td>" +
          '<button class="btn secondary" data-edit="' + u.id + '">Editar</button> ' +
          '<button class="btn danger" data-del="' + u.id + '">Borrar</button>' +
        "</td></tr>";
    }).join("");
  }

  $("#buscar, #filtro-rol").on("input change", renderUsuarios);

  $(document).on("click", "[data-edit]", function () {
    openUser(Number($(this).data("edit")));
  });

  $(document).on("click", "[data-del]", function () {
    var id = Number($(this).data("del"));
    db.usuarios = db.usuarios.filter(function (u) { return u.id !== id; });
    persist();
    renderAll();
  });

  $("#nuevo-usuario").on("click", function () {
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
    $("#u-password").val(u.password);
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
    var record = {
      id: id ? Number(id) : Date.now(),
      nombre: $("#u-nombre").val(),
      email: $("#u-email").val(),
      password: $("#u-password").val(),
      rol: $("#u-rol").val(),
      telefono: $("#u-telefono").val(),
      curp: $("#u-curp").val(),
      rfc: $("#u-rfc").val(),
      municipio: $("#u-municipio").val(),
      tipo: $("#u-tipo").val(),
      estatus: $("#u-estatus").val(),
      registrado: new Date().toISOString().slice(0, 10)
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

  function csvUsuarios() {
    var header = "id,nombre,email,password,rol,telefono,curp,rfc,municipio,tipo,estatus";
    var lines = db.usuarios.map(function (u) {
      return [u.id, u.nombre, u.email, u.password, u.rol, u.telefono, u.curp, u.rfc, u.municipio, u.tipo, u.estatus].join(",");
    });
    return header + "\n" + lines.join("\n");
  }

  $("#csv-usuarios").on("click", function () {
    var csv = csvUsuarios();
    $("#preview-export").text(csv);
    download("usuarios-yucatan.csv", csv, "text/csv");
  });

  $("#json-pagos").on("click", function () {
    var json = JSON.stringify(db.pagos, null, 2);
    $("#preview-export").text(json);
    download("pagos-yucatan.json", json, "application/json");
  });

  $("#json-completo").on("click", function () {
    var json = JSON.stringify(db, null, 2);
    $("#preview-export").text(json);
    download("respaldo-sdy.json", json, "application/json");
  });

  function fillRolSelect() {
    document.getElementById("rol-usuario").innerHTML = db.usuarios.map(function (u) {
      return '<option value="' + u.id + '">' + u.nombre + " (" + u.rol + ")</option>";
    }).join("");
  }

  $("#activar-todos").on("click", function () {
    db.usuarios.forEach(function (u) {
      if (u.estatus === "suspendido") u.estatus = "activo";
    });
    persist();
    renderAll();
  });

  $("#purgar").on("click", function () {
    db.usuarios = db.usuarios.filter(function (u) { return u.estatus !== "inactivo"; });
    persist();
    renderAll();
  });

  $("#reset-db").on("click", function () {
    db = JSON.parse(JSON.stringify(INITIAL_DB));
    persist();
    fillMunicipios();
    renderAll();
  });

  $("#aplicar-rol").on("click", function () {
    var id = Number($("#rol-usuario").val());
    var rol = $("#rol-nuevo").val();
    db.usuarios.forEach(function (u) {
      if (u.id === id) u.rol = rol;
    });
    persist();
    renderAll();
  });

  function renderAll() {
    renderStats();
    renderBars();
    renderUsuarios();
    renderReportes();
    fillRolSelect();
  }

  loadDb();
})();
