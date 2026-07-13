from services.tasks import app, scan_region

@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(
        432000.0,
        scan_region.s("rondonia"),
        name='scan-rondonia-5-days' #realized sentile orbits/makes a trip in 5 days so removing redundant calls. ill go back to daily when i increase areas
    )