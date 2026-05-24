import { EngineDemoApplication } from './demo-application'
import './style.css'

const application = await EngineDemoApplication.create()
application.start()
