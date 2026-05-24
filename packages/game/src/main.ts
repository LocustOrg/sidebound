import { DemoApplication } from './demo-application'
import './style.css'

const application = await DemoApplication.create()
application.start()
