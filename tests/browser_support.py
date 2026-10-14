"""Validation déclarée exclusivement sur les données fictives des tests."""
def approve_period(form):
 form.locator('[name=periodicityConfirmed]').check()
 form.locator('[name=periodicityReason]').fill('Règle fictive, sans portée réglementaire')
 form.locator('[name=validationAuthor]').fill('Responsable fictif')
def approve_manual(form):
 form.locator('[name=manualDateConfirmed]').check()
 form.locator('[name=manualDateSource]').fill('Document fictif de test')
 form.locator('[name=manualDateReason]').fill('Première échéance explicitement justifiée pour le test')
 form.locator('[name=manualDateAuthor]').fill('Responsable fictif')

def choose_missing_assignment(form):
 """Explicit no-assignment choices for fictional equipment, preserving assigned fixture values."""
 for field,choice in [('sector','Pas de secteur'),('team','Pas d’équipe')]:
  select=form.locator('[name='+field+']')
  if not select.input_value():select.select_option(choice)
