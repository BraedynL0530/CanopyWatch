from services.tasks import app, scan_brazil_region

@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(
        432000.0,
        scan_brazil_region.s("para_frontier"),
        name='scan-para-frontier-5-days'
    )
    sender.add_periodic_task(
        432000.0,
        scan_brazil_region.s("acre_frontier"),
        name='scan-acre-frontier-5-days'
    )