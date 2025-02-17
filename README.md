# kymetaOW-monitor

Ruteo Basado en Políticas en Raspberry Pi
Esta configuración permite que el tráfico con origen en 192.168.10.30 utilice una tabla de rutas personalizada para salir por la puerta de enlace 192.168.10.1.

1. Crear una Tabla de Rutas Personalizada
Edita el archivo /etc/iproute2/rt_tables y añade la siguiente línea:

bash
Copiar
Editar
200 rt_eth0
Explicación: Esto asigna la tabla de rutas rt_eth0 con prioridad 200.

2. Agregar la Ruta por Defecto a la Tabla Personalizada
Ejecuta el siguiente comando:

bash
Copiar
Editar
ip route add default via 192.168.10.1 dev eth0 table rt_eth0
Explicación: Define la puerta de enlace 192.168.10.1 como ruta por defecto para la tabla rt_eth0.

3. Agregar una Regla de Ruteo Basada en el Origen
Ejecuta:

bash
Copiar
Editar
ip rule add from 192.168.10.30/32 table rt_eth0
Explicación: Todo el tráfico que se origine en 192.168.10.30 usará la tabla rt_eth0 para su ruteo.

4. Verificar la Configuración
Para comprobar las reglas y rutas, utiliza:

bash
Copiar
Editar
ip rule list         # Muestra todas las reglas de ruteo
ip route show table rt_eth0   # Muestra la tabla de rutas personalizada
Explicación: Estos comandos permiten revisar que la configuración se haya aplicado correctamente.

Nota
Estos cambios son volátiles y se perderán al reiniciar el sistema. Para hacerlos persistentes, intégralos en un script de inicio o en los archivos de configuración de red de tu distribución.
