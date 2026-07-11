from services.tasks import app, scan_region

@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(
        86400.0,
        scan_region.s("rondonia"),
        name='scan-rondonia-daily'
    )