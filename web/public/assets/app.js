/* quivoto — landing. Dues coses: el compte enrere i l'enviament del correu.
   Sense JS el formulari continua funcionant (POST normal cap a /api/subscribe.php). */
(function () {
  'use strict';

  // Compte enrere fins al 23 de maig de 2027
  var compte = document.getElementById('compte');
  if (compte && compte.dataset.plantilla) {
    var dies = Math.max(0, Math.ceil((new Date(2027, 4, 23) - new Date()) / 86400000));
    compte.textContent = compte.dataset.plantilla.replace('{dies}', dies);
  }

  var formularis = document.querySelectorAll('form[data-idioma]');
  if (!formularis.length || !window.fetch) return;
  var textOk = document.documentElement.lang === 'es' ? '¡Hecho! Nos vemos pronto.' : 'Fet! Ens veiem aviat.';
  var textError = document.documentElement.lang === 'es' ? 'No ha funcionado. Inténtalo otra vez.' : 'No ha funcionat. Torna-ho a provar.';

  Array.prototype.forEach.call(formularis, function (form) {
  var resposta = form.querySelector('.resposta');
  var boto = form.querySelector('button[type=submit]');
  form.addEventListener('submit', function (ev) {
    if (!form.checkValidity()) return;          // deixem que el navegador avisi
    ev.preventDefault();
    boto.disabled = true;
    resposta.className = 'resposta';
    resposta.textContent = '…';

    fetch(form.action, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (d) {
        if (d && d.ok) {
          resposta.className = 'resposta ok';
          resposta.textContent = d.missatge || textOk;
          form.reset();
        } else {
          resposta.className = 'resposta error';
          resposta.textContent = (d && d.missatge) || textError;
        }
      })
      .catch(function () {
        resposta.className = 'resposta error';
        resposta.textContent = textError;
      })
      .finally(function () { boto.disabled = false; });
  });
  });
})();
