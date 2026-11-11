<!-- The free trial request. fleet/site.js handles the submit: it checks the name and email and opens the visitor's mail app with a drafted message to hello@netquor.com. Nothing is posted to a server, as before. -->
<form id="lead-form" class="card form" novalidate>
  <label>Your name<input name="name" autocomplete="name" required maxlength="100" /></label>
  <label>Work email<input name="email" type="email" autocomplete="email" required maxlength="254" /></label>
  <label>Company<input name="company" autocomplete="organization" maxlength="120" /></label>
  <div class="two">
    <label>Macs<input name="macs" type="number" min="0" max="100000" value="0" inputmode="numeric" /></label>
    <label>iPhones &amp; iPads<input name="ios" type="number" min="0" max="100000" value="0" inputmode="numeric" /></label>
  </div>
  <label>Anything we should know?<textarea name="message" rows="3" maxlength="2000"></textarea></label>
  <!-- A field only a bot fills in. -->
  <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
  <input type="hidden" name="term" value="annual" />
  <input type="hidden" name="dedicated" value="0" />
  <button class="btn" type="submit">Start free <svg class="ico"><use href="#i-arrow"/></svg></button>
  <p id="lead-status" class="status" role="status" aria-live="polite"></p>
</form>
