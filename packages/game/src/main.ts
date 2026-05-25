import { DemoApplication } from './demo-application.ts'
import './style.css'

const application = await DemoApplication.create()
application.start()
