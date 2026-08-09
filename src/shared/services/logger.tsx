import log from "loglevel"

log.setLevel(__DEV__ ? "debug" : "warn")

export default log
