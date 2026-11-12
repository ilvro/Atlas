import gi, sys, json
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib
url, jsfile, out, wait = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
JS = open(jsfile).read()
win = Gtk.OffscreenWindow(); wv = WebKit2.WebView()
st = wv.get_settings(); st.set_enable_webgl(True); st.set_enable_developer_extras(True)
try: st.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)
except Exception as e: print('hw', e)
win.add(wv); win.set_default_size(1440, 860); win.show_all()
def snap_done(o, res):
    try:
        s = wv.get_snapshot_finish(res); s.write_to_png(out); print('png', out)
    except Exception as e: print('SNAPERR', e)
    Gtk.main_quit()
def snap():
    wv.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, snap_done); return False
def done2(o, res):
    try: print('js:', wv.evaluate_javascript_finish(res).to_string())
    except Exception as e: print('JSERR', e)
    snap()
def read():
    wv.evaluate_javascript('String(window.__r)', -1, None, None, None, done2); return False
def done(o, res):
    GLib.timeout_add_seconds(wait, read)
def run():
    wv.evaluate_javascript('window.__r="pendente"; (' + JS + ').then(function(v){window.__r=v}, function(e){window.__r="ERRO "+e}); 1', -1, None, None, None, done); return False
def loaded(v, ev):
    if ev == WebKit2.LoadEvent.FINISHED: GLib.timeout_add_seconds(4, run)
wv.connect('load-changed', loaded)
wv.load_uri(url)
GLib.timeout_add_seconds(90, Gtk.main_quit)
Gtk.main()
